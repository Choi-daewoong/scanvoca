# NAS(Container Manager)에서 실행하는 배치 컨테이너 — Cloud Run에는 배포되지 않는다.
# DSM 작업 스케줄러는 일반 사용자 권한으로 docker 명령을 실행할 수 없어 주기 실행에 못
# 쓴다 — 대신 main.py 자체가 --loop-seconds(또는 CLIPPER_LOOP_SECONDS)를 받으면
# "1회 실행 -> N초 대기 -> 재실행"을 스스로 반복한다(main.py의 run_loop() 참고).
# 예전에는 이 반복을 컨테이너 entrypoint를 `sh -c "while true; do python main.py;
# sleep 604800; done"`로 덮어써서 NAS 쪽 compose.yaml(git 추적 안 됨)에만 넣어뒀는데,
# 실패 시각이 로그에 전혀 안 남아 디버그가 안 됐다 — 이제는 이 저장소의 compose.yaml을
# 그대로 쓰면 되고, 실행마다 타임스탬프 로그가 남으며 한 번의 실패가 전체를 죽이지 않는다.
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
