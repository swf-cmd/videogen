<div align="center">

# videogen

**프롬프트 목록이나 CSV를, 골라 둔 AI 동영상 묶음으로. 내 컴퓨터에서, 내 공급자 키로.**

[![최신 릴리스](https://img.shields.io/github/v/release/swf-cmd/videogen?label=release)](https://github.com/swf-cmd/videogen/releases/latest)
[![테스트와 포터블 패키지](https://github.com/swf-cmd/videogen/actions/workflows/portable.yml/badge.svg?branch=main)](https://github.com/swf-cmd/videogen/actions/workflows/portable.yml)
[![MIT 라이선스](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Node.js ^22.21 또는 24.5 이상](https://img.shields.io/badge/node-%5E22.21%20%7C%7C%20%E2%89%A524.5-339933?logo=nodedotjs&logoColor=white)
![npm 의존성 0개](https://img.shields.io/badge/npm%20dependencies-0-brightgreen)
![Windows·macOS·Linux](https://img.shields.io/badge/platform-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-lightgrey)

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어**

</div>

[![사용 시연: CSV와 이미지 폴더 가져오기, 비용 확인, 대기열 진행, 키보드로 선별](docs/media/videogen-workflow.gif)](docs/media/videogen-workflow.webm)

<sub>로컬 대체 엔드포인트에 연결해 오프라인으로 녹화했습니다. 영상은 프로그램으로 그린 테스트용 애니메이션이며 **AI 생성 결과가 아닙니다**. 초당 $0.05 가격은 로컬 예시 카탈로그 값이며 공급자 견적이 아닙니다. 유료 API는 호출하지 않았습니다.</sub>

**[Windows / macOS 버전 다운로드](https://github.com/swf-cmd/videogen/releases/latest)** · [소스로 실행](#시작) · [원본 크기 녹화](docs/media/videogen-workflow.webm) · [Sora 2에서 이전하기](docs/MIGRATING_FROM_SORA.md)

> [!NOTE]
> **OpenAI는 2026-09-24에 Sora 2 API를 종료했습니다**([지원 중단 목록](https://developers.openai.com/api/docs/deprecations)). videogen은 Sora2App의 후속 프로젝트로, 같은 로컬 일괄 작업 흐름을 OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine / BytePlus Ark 또는 직접 운영하는 OpenAI 호환 서버에서 이어 갑니다. 이전 Sora 작업은 자동으로 옮길 수 없으니 [이전 안내](docs/MIGRATING_FROM_SORA.md)에서 보관할 항목을 확인하세요.

## videogen의 특징

- **한 편씩이 아니라 한꺼번에.** 빈 줄로 구분한 프롬프트를 붙여 넣거나, 템플릿 변수가 있는 UTF-8 CSV와 이미지 폴더를 가져옵니다. 행마다 시작 프레임(모델이 지원하면 끝 프레임도)을 지정할 수 있고, ‘프롬프트당 테이크 수’로 각 행을 1~20번 생성합니다.
- **가장 좋은 테이크를 빠르게.** 완성된 영상은 샷·테이크별로 갤러리에 모입니다. **J/K** 이동, **Space** 재생, **1** 보관, **2** 제외. 보관한 테이크는 경로·프롬프트·설정·SHA-256이 담긴 CSV/JSON으로 내보내 편집 프로그램에 넘길 수 있습니다.
- **제출 전에 비용 확인.** 각 행을 모델 지원 기능으로 검증하고 비용을 추정한 뒤에야 전송합니다. 배치 예산과 보관한 영상 한 편당 추정 비용도 볼 수 있습니다. 모르는 가격은 추측하지 않고 ‘알 수 없음’으로 표시합니다.
- **중복 과금을 막는 설계.** 대기열은 로컬 서비스가 관리하므로 브라우저를 닫아도 상관없고, 충돌이나 재시작 뒤에도 알려진 작업을 계속 추적합니다. 결과가 불확실한 생성 요청은 자동으로 다시 보내지 않고 사용자의 판단을 기다립니다. SIGKILL 재시작을 포함한 100개 작업 시험에서 중복 생성은 0건이었습니다.
- **로컬 실행, 개인정보 보호.** 서비스는 `127.0.0.1`에서만 동작합니다. 키는 메모리에만 있고 프롬프트·이미지·기록은 내 데이터 폴더에 남습니다. 계정, 원격 분석, 업데이트 확인, npm 의존성이 없습니다.
- **여러 공급자, 하나의 흐름.** 날짜가 표시된 내장 카탈로그에 OpenRouter·Gemini·Model Studio·Ark의 동영상 모델 31종(Veo 3.1, Kling 3.0, Seedance 2.5, Wan 3.0, Runway Gen-4.5 등)이 있으며, 직접 운영하는 OpenAI 호환 서버도 쓸 수 있습니다. [자세히(영어)](README.md#providers-and-estimates)

<p align="center"><img src="docs/media/videogen-review.png" width="680" alt="샷과 테이크별로 묶인 갤러리. 보관·제외·미검토 상태, 총비용과 보관 영상당 추정 비용, 내보내기 버튼과 키보드 단축키 안내"></p>
<p align="center"><sub>같은 오프라인 실행의 선별 화면(테스트용 애니메이션, 예시 가격).</sub></p>

## 시작

**설치 없는 ZIP:** [Releases](https://github.com/swf-cmd/videogen/releases/latest)에서 Windows x64 또는 macOS universal 파일을 받아 쓰기 가능한 폴더에 전체 압축을 풉니다. Windows에서는 **Start videogen.cmd**, Mac에서는 **Start videogen.command**를 두 번 클릭하세요. Node 24 LTS가 포함되어 있으며 Apple Silicon과 Intel Mac을 모두 지원합니다.

운영체제가 첫 실행 확인을 요청할 수 있습니다. macOS에서는 **시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기**를 확인하세요. 이 ZIP은 공증된 `.app` 설치 파일이 아닙니다. 자세한 방법과 체크섬은 [포터블 패키지 설명](docs/PORTABLE.md)에 있습니다.

**소스 실행:** Node `^22.21.0 || >=24.5.0`이 필요합니다. Node 18, 20, 23은 지원하지 않습니다. `npm install`은 필요 없습니다.

```bash
git clone https://github.com/swf-cmd/videogen.git
cd videogen
npm start
```

출력된 로컬 주소(기본값 `http://127.0.0.1:5177`)를 여세요. 작업 중에는 터미널을 열어 두고, 종료할 때 Ctrl+C를 누른 뒤 진행 중인 요청을 기록하도록 최대 15초 기다리세요. 저장 폴더는 하드 링크를 지원해야 하며 exFAT는 지원하지 않습니다. 브라우저를 닫아도 서비스의 대기열은 계속 실행됩니다. 포터블 패키지는 기록을 `portable-data/`, 영상을 `portable-output/`에 저장합니다. 소스 실행의 기본 영상 폴더는 `~/Downloads/videogen`입니다.

## 일괄 작업과 선별

[CSV 열·템플릿·이미지 연결 안내](docs/BATCH_IMPORT.md)에 복사해서 사용할 수 있는 예제가 있습니다.

1. 공급자·지역·모델을 선택합니다. 호환 서버를 사용한다면 정확한 URL, 모델 ID, 지원 기능, 요청 형식을 지정하세요. Model Studio는 작업 공간 전용 호스트 이름이 필요합니다.
2. 해당 연결의 API 키를 저장합니다. 키는 서비스 메모리에만 보관되고 종료하면 사라집니다. 다시 시작하면 키를 다시 입력하세요.
3. 빈 줄로 구분한 프롬프트를 입력하거나 UTF-8 CSV·템플릿·이미지 폴더를 가져옵니다. 각 행에 시작 프레임을 지정하고 모델이 지원하면 끝 프레임도 지정할 수 있습니다. ‘프롬프트당 테이크 수’(1~20)를 설정하면 각 프롬프트·행을 여러 번 생성해 비교할 수 있으며, 파일 이름에 `-t1`, `-t2`… 가 붙습니다.
4. 행별 검증 결과와 비용 추정치를 확인한 뒤 명시적으로 제출합니다. 확인되지 않은 가격은 ‘알 수 없음’으로 표시하며 통화별 합계를 따로 보여 줍니다.
5. 완성된 영상은 샷·테이크별로 묶여 갤러리에 표시됩니다. 키보드만으로 선별할 수 있으며(**J/K** 또는 방향키로 이동, **Space** 재생, **1** 보관, **2** 제외, **3/U** 미검토로 되돌리기) 표시한 뒤에는 다음 미검토 테이크로 이동합니다. 보관한 영상 한 편당 추정 비용을 확인하고, ‘보관본 내보내기(CSV)’로 출력 경로·프롬프트·모델·설정·샷/테이크·비용·SHA-256이 담긴 목록을 편집 프로그램이나 팀용으로 저장할 수 있습니다(JSON과 전체 테이크 버전은 메뉴에 있음). 다시 생성할 때는 매번 확인이 필요하며 공급자 요금이 새로 발생할 수 있고, 배치 예산을 넘는 재생성은 거부됩니다. 선택 사항인 데스크톱 알림으로 배치 완료·검토 필요·키 대기를 알려 줍니다.

예산은 추정치를 기준으로 앞으로 제출할 작업을 제한하며 실제 청구액을 보장하지 않습니다. 잔액 부족이나 모델 권한 오류로 새 제출이 중지되어도 이미 수락된 작업의 상태 조회와 다운로드는 계속됩니다. 다운로드는 원본 바이트를 유지하며 같은 이름의 파일을 덮어쓰지 않습니다.

## 복구와 공급자

생성 요청의 수락 여부를 알 수 없는 작업은 `needs_review`로 바뀌며 자동 재제출하지 않습니다. 공급자 콘솔에서 확인한 뒤 ‘생성되지 않았음을 확인하고 재제출’, ‘추적 중단’, ‘기존 원격 ID 연결’ 중 하나를 선택하세요. 로컬 추적 중단은 원격 작업 취소나 환불을 의미하지 않습니다. 실행 중인 작업도 ‘추적 중지’할 수 있습니다(잘못된 원격 ID를 연결한 경우 등). 공급자가 실행 중인 작업에 15분 동안 끊김 없이 404/410만 반환하면 작업은 `remote_not_found`로 실패하고 원격 ID는 확인용으로 남습니다. 잔액 부족을 포함한 그 밖의 4xx는 수락된 작업의 조회·다운로드 중에 재시도하며 결제된 결과를 바로 버리지 않습니다.

Gemini는 `background: true`로 interaction ID를 먼저 저장한 후 상태를 조회하며 재시작 뒤에도 이어서 조회할 수 있습니다. ID를 받기 전에 연결이 끊기면 여전히 수동 확인이 필요할 수 있습니다. OpenRouter는 모델이 지원을 명시한 경우 로컬 이미지를 data URL로 `frame_images`에 전달하며 모델 목록의 기능과 가격을 따릅니다. Seedance 토큰 가격은 OpenRouter가 공개한 공식(높이 × 너비 × 초 × 24 / 1024)으로 추정합니다. OpenRouter 요청에는 videogen을 나타내는 앱 출처 헤더(사용자 데이터 없음)가 포함되며 `VIDEOGEN_OPENROUTER_ATTRIBUTION=0`으로 끌 수 있습니다. Google은 2026-10-22에 Gemini API에서 Veo 3.1 프리뷰 모델 제공을 종료하고 Omni를 후속 모델로 안내합니다. Veo는 OpenRouter를 통해 계속 사용할 수 있습니다.

OpenRouter, Gemini, Alibaba Cloud Model Studio, Volcengine / BytePlus Ark, 직접 설정한 OpenAI 호환 서버를 지원합니다. 계정, 지역, 모델 접근, 요금에는 각 서비스의 조건이 적용됩니다. [기능·가격과 지역 조건](README.md#providers-and-estimates) · [공급자 명세](docs/providers/)

## 로컬 데이터와 개발

프롬프트, 참조 이미지, 작업 상태, 선별 결과, 출력 경로는 로컬 디스크에 저장됩니다. 생성할 때는 선택한 공급자에게 프롬프트와 이미지가 전송됩니다. 프로젝트가 운영하는 클라우드, 원격 분석, 업데이트 확인 기능은 없습니다. 사용한 폴더를 공유하면 개인 기록과 이미지도 포함될 수 있습니다. [개인정보 설명](PRIVACY.md)

`VIDEOGEN_DATA_DIR`와 `VIDEOGEN_OUTPUT_DIR`로 저장 위치를 바꿀 수 있습니다. 프록시는 `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`로 설정하며 로컬 연결은 프록시를 우회합니다. [자세한 프록시 설정](README.md#proxy-configuration)

```bash
npm test
npm run test:e2e
```

테스트는 로컬 모의 서비스를 사용하며 유료 API를 호출하지 않습니다. 이전 Sora2App의 Batch / Files 작업을 다른 공급자로 자동 이전하지 않습니다. 기존 동영상과 프롬프트를 백업하고 [이전 안내](docs/MIGRATING_FROM_SORA.md)를 확인하세요.

[MIT 라이선스](LICENSE) · [변경 기록](CHANGELOG.md) · [기여 안내](CONTRIBUTING.md)

이전 버전의 짧은 키로 데이터가 손상된 경우 [오프라인 격리 복구](docs/DATA_RECOVERY.md)를 참고하세요.
