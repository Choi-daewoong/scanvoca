# NAS(Container Manager)에서 실행하는 배치 컨테이너 — Cloud Run에는 배포되지 않는다.
# DSM 작업 스케줄러는 일반 사용자 권한으로 docker 명령을 실행할 수 없어 주기 실행에 못
# 쓴다 — 대신 이 이미지를 쓰는 compose.yaml(NAS `/docker/clipper/`)이 entrypoint를
# `sh -c "while true; do python main.py; sleep 604800; done"`로 오버라이드해, 컨테이너
# 스스로 "1회 실행 -> 7일 대기 -> 재실행"을 반복한다(restart: unless-stopped).
# 이미지 자체는 여기서 빌드해 scanvoca-clipper.tar로 export한 뒤 NAS에 업로드하고
# Container Manager에서 이미지로 등록해야 반영된다 — NAS에는 이 Dockerfile이 없다.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY clipper/ ./clipper/
COPY main.py .

ENTRYPOINT ["python", "main.py"]
