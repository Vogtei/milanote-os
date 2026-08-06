import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const bucket = process.env.S3_BUCKET ?? "milanote-os";

const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true, // required for MinIO's S3-compatible API
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  },
});

let bucketReady: Promise<void> | null = null;

// Lazily create the bucket (and make it public-read) on first upload,
// instead of requiring a separate provisioning step for local/dev use.
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      } catch {
        await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        await s3.send(
          new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: { AWS: ["*"] },
                  Action: ["s3:GetObject"],
                  Resource: [`arn:aws:s3:::${bucket}/*`],
                },
              ],
            }),
          }),
        );
      }
    })();
  }
  return bucketReady;
}

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${endpoint}/${bucket}/${key}`;
}
