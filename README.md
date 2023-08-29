# Whisper Large Benchmark

This project demonstrates and benchmarks the performance of the Whisper Large model on the Commonvoice English Corpus 14, an open source dataset of voice recordings and transcriptions that includes 3,279 hours of audio.

## Getting Started

To get started with this project, you will need to have Docker installed on your system. Once you have Docker installed, you can run the following command to start the sdnext container:

```bash
docker run --gpus all \
-e BENCHMARK_SIZE=10 \
-e REPORTING_URL=https://someurl.com \
-e QUEUE_URL=https://someurl.com \
-e QUEUE_NAME=whisper-large-benchmark-0 \
-e REPORTING_API_KEY=1234567890 \
-e BENCHMARK_NAME=whisper-large-benchmark-0 \
saladtechnologies/whisper-large-benchmark:latest
```

or

```bash
docker compose up
```

The `BENCHMARK_SIZE` environment variable can be adjusted to change the size of the benchmark (total clips to transcribe). The default value is `10`, but you can set it to `-1` to let it run forever.

## Build the image

To build the image, run the following command:

```bash
docker buildx build -t saladtechnologies/whisper-large-benchmark:latest --provenance=false --output type=docker .
```