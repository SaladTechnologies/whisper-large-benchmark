import { WhisperRequest, WhisperResponse, QueueMessage, DeleteQueueMessageResponse, TranscriptionJobRaw, TranscriptionJob, GetJobFromQueueResponse } from "./types";
import fs from "node:fs";

const { 
  WHISPER_URL = "http://localhost:1111", 
  BENCHMARK_SIZE = "10", 
  REPORTING_URL = "http://localhost:3000",
  REPORTING_AUTH_HEADER = "Benchmark-Api-Key",
  REPORTING_API_KEY = "abc1234567890",
  BENCHMARK_ID = "whisper-test",
  QUEUE_NAME = "whisper-test",
  QUEUE_URL = "http://localhost:9324",
} = process.env;

const benchmarkSize = parseInt(BENCHMARK_SIZE, 10);

/**
 * This is the job that will be submitted to the server,
 * set to the configured batch size.
 * 
 * You can change this to whatever you want, and there are a lot
 * of options. See the SDNext API docs for more info.
 */
const testJob: WhisperRequest = fs.readFileSync("./Recording.wav");

/**
 * You can replace this function with your own implementation.
 * Could be submitting stats to a database, or to an api, or just
 * printing to the console.
 */
async function recordResult(result: { clipId: string, transcription: string, time_elapsed: number}): Promise<void> {
  const url = new URL("/" + BENCHMARK_ID, REPORTING_URL);
  await fetch(url.toString(), {
    method: "POST",
    body: JSON.stringify(result),
    headers: {
      "Content-Type": "application/json",
      [REPORTING_AUTH_HEADER]: REPORTING_API_KEY,
    },
  });
}


/**
 * You can replace this function with your own implementation.
 * 
 * @returns A job to submit to the server
 */
async function getJob(): Promise<TranscriptionJob | null> {
  const url = new URL(`/${QUEUE_NAME}`, QUEUE_URL);

  const jobResponse = await fetch(url.toString(), {
    method: "GET",
    headers: {
      [REPORTING_AUTH_HEADER]: REPORTING_API_KEY,
    },
  });
  const queueMessage = await jobResponse.json() as GetJobFromQueueResponse;
  if (queueMessage.messages?.length) {
    const job = JSON.parse(queueMessage.messages[0].body) as TranscriptionJobRaw;

    const clipResponse = await fetch(job.url);
    const clip = await clipResponse.arrayBuffer();

    return {
      messageId: queueMessage.messages[0].messageId,
      clip: Buffer.from(clip),
      clipId: job.clipId,
    };
  } else {
    return null;
  }
}

/**
 * Submits a job to the SDNext server and returns the response.
 * @param job The job to submit to the server
 * @returns The response from the server
 */
async function submitJob(job: WhisperRequest): Promise<WhisperResponse> {
  // POST to SDNEXT_URL
  const url = new URL("/generate/", WHISPER_URL);
  const response = await fetch(url.toString(), {
    method: "POST", 
    body: job,
    headers: {
      "Content-Type": "application/octet-stream"
    },
  });

  const json = await response.json();
  return json as WhisperResponse;
}

async function markJobComplete(job: TranscriptionJob): Promise<DeleteQueueMessageResponse> {
  const url = new URL(`/${QUEUE_NAME}/${encodeURIComponent(job.messageId)}`, QUEUE_URL);
  const response = await fetch(url.toString(), {
    method: "DELETE",
  });
  const json = await response.json() as DeleteQueueMessageResponse;

  return json;
}

/**
 * Uses the status endpoint to get the status of the SDNext server.
 * @returns The status of the SDNext server
 */
async function getServerStatus(): Promise<string> {
  const url = new URL("/hc", WHISPER_URL);
  const response = await fetch(url.toString());
  return response.text();
}


async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let stayAlive = true;
process.on("SIGINT", () => {
  stayAlive = false;
});

process.on("exit", () => {
  /**
   * This is where to put any cleanup code,
   * or a last chance to fire stats off to wherever they live.
   */
});


/**
 * Waits for the SDNext server to start listening at the configured URL.
 */
async function waitForServerToStart(): Promise<void> {
  const maxAttempts = 300;
  let attempts = 0;
  while (stayAlive && attempts++ < maxAttempts) {
    try {
      await getServerStatus();
      return;
    } catch (e) {
      console.log(`(${attempts}/${maxAttempts}) Waiting for server to start...`);
      await sleep(1000);
    }
  }
}


/**
 * This is a helper function to pretty print an object,
 * useful for debugging.
 * @param obj The object to pretty print
 * @returns 
 */
const prettyPrint = (obj: any): void => console.log(JSON.stringify(obj, null, 2));

/**
 * This is the main function that runs the benchmark.
 */
async function main(): Promise<void> {
  const loadStart = Date.now();
  await waitForServerToStart();

  // This serves as the final pre-flight check
  let response = await submitJob(testJob);
  prettyPrint(response);

  const loadEnd = Date.now();
  const loadElapsed = loadEnd - loadStart;
  console.log(`Server fully warm in ${loadElapsed}ms`);

  let numTranscriptions = 0;
  const start = Date.now();
  while (stayAlive && (benchmarkSize < 0 || numTranscriptions < benchmarkSize)) {
    console.log("Fetching Job...");
    const job = await getJob();
    if (job === null) {
      console.log("No jobs available, waiting...");
      await sleep(1000);
      continue;
    }

    console.log("Submitting Job...");
    const jobStart = Date.now();
    response = await submitJob(job.clip);
    const jobEnd = Date.now();
    const jobElapsed = jobEnd - jobStart;
    console.log(`Clip ${job.clipId} took ${jobElapsed}ms`);
    recordResult({
      clipId: job.clipId,
      transcription: response.text,
      time_elapsed: jobElapsed,
    });
    numTranscriptions += 1;
    markJobComplete(job);
  }

  const end = Date.now();
  const elapsed = end - start;
  console.log(`Generated ${numTranscriptions} images in ${elapsed}ms`);
  console.log(`Average time per image: ${elapsed / numTranscriptions}ms`);
}

main();