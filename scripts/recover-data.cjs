#!/usr/bin/env node
const { recoverData } = require("../src/store/recovery");
const args = process.argv.slice(2);
const explanations = {
  recoveryArgumentsRequired: "Provide --source OLD_DIRECTORY and --destination NEW_DIRECTORY.",
  recoveryAmbiguousStore: "The record sequence or structure is ambiguous. Keep the original evidence; this tool cannot safely skip those records.",
  recoveryDestinationExists: "Choose a destination that does not already exist.",
  recoveryDestinationReserved: "Another recovery reserved this destination. If an earlier recovery was interrupted, inspect its staging directory and reservation file or choose a different destination.",
  recoveryUnsafeDestination: "The destination must be separate from the source, with an existing parent directory.",
  recoveryUnsafePath: "The source contains a symbolic link or unsupported file type. Use an ordinary local directory without links.",
  recoverySourceChanged: "The source changed while being copied. Stop all programs that modify it and retry with a new destination.",
  dataLocked: "Stop videogen using this source directory before recovering it.",
  ENOENT: "The source or destination parent directory does not exist.",
  EACCES: "The source must be readable and its lock location and destination parent must be writable.",
  EPERM: "The filesystem refused the operation. Check permissions and use a local filesystem that supports hard links.",
  ENOSPC: "There is not enough free space to preserve the evidence and recovered data.",
};
if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log("Usage: node scripts/recover-data.cjs --source OLD_DIRECTORY --destination NEW_DIRECTORY\nStop videogen first. The new directory contains recovery-report.json and recovery-original. Recovery does not start the server.");
} else {
  try {
    const values = {};
    for (let index = 0; index < args.length; index += 2) {
      if (!["--source", "--destination"].includes(args[index]) || !args[index + 1] || values[args[index].slice(2)]) throw Object.assign(new Error("recoveryArgumentsRequired"), { code: "recoveryArgumentsRequired" });
      values[args[index].slice(2)] = args[index + 1];
    }
    const result = recoverData(values);
    console.log(`Recovered directory: ${result.directory}\nRecovery report: ${result.reportPath}\nRetained: ${result.retainedJobs}; paid jobs: ${result.retainedPaidJobs}; needs review: ${result.needsReview}; quarantined: ${result.quarantinedJobs}.\nAll lanes and batches are paused. The server was not started.`);
  } catch (error) {
    const code = error.code || "recoveryFailed";
    const detail = code === "recoveryAmbiguousStore" && typeof error.details === "string" ? ` Detail: ${error.details}.` : "";
    console.error(`Recovery refused (${code}). ${explanations[code] || "Keep the original directory and inspect filesystem access before retrying."}${detail} No partial recovery is published.`);
    process.exitCode = 1;
  }
}
