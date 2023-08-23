export type WhisperRequest = Buffer;

export type WhisperResponse = {
  text: string;
  inference_time: string;
}

export type GetJobFromQueueResponse = {
  status: string;
  messages: QueueMessage[];
};

export type QueueMessage = {
  messageId: string;
  body: string;
};

export type TranscriptionJobRaw = {
  clipId: string;
  url: string;
}

export type TranscriptionJob = {
  messageId: string;
  clip: Buffer;
  clipId: string;
}

export type DeleteQueueMessageResponse = {
  message: "Message deleted";
};