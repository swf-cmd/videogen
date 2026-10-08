let confirmationOpen = false;

function confirmAction(message, { danger = false } = {}) {
  // A second operation cannot replace the choice the user is already reviewing.
  if (confirmationOpen) return Promise.resolve(false);
  const dialog = document.querySelector("#confirmDialog");
  const accept = document.querySelector("#confirmAccept");
  const cancel = document.querySelector("#confirmCancel");
  const previousFocus = document.activeElement;
  document.querySelector("#confirmTitle").textContent = t("confirmTitle");
  document.querySelector("#confirmMessage").textContent = message;
  accept.textContent = t("confirmProceed");
  cancel.textContent = t("cancel");
  accept.className = danger ? "secondary danger-action" : "primary-action";
  confirmationOpen = true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (approved) => {
      if (settled) return;
      settled = true;
      accept.removeEventListener("click", approve);
      cancel.removeEventListener("click", decline);
      dialog.removeEventListener("cancel", dismiss);
      dialog.removeEventListener("close", closed);
      confirmationOpen = false;
      if (dialog.open) dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(approved);
    };
    const approve = () => finish(true);
    const decline = () => finish(false);
    const dismiss = (event) => { event.preventDefault(); finish(false); };
    const closed = () => { if (!dialog.open) finish(false); };
    accept.addEventListener("click", approve);
    cancel.addEventListener("click", decline);
    dialog.addEventListener("cancel", dismiss);
    dialog.addEventListener("close", closed);
    try {
      dialog.showModal();
      // Enter must not accidentally approve a paid resubmission.
      cancel.focus();
    } catch {
      finish(false);
    }
  });
}
