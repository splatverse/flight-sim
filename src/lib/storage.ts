import crypto from 'crypto';

// Media storage: any S3-compatible bucket, configured with the STORAGE_* variables
// in .env.example. Uploads are signed with Signature Version 4 (SigV4, the S3 API's
// standard request signing), so no SDK dependency is needed.
const bucket = process.env.STORAGE_BUCKET;
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
const endpoint = process.env.STORAGE_ENDPOINT;
const publicUrl = process.env.STORAGE_PUBLIC_URL;
const region = process.env.STORAGE_REGION || 'auto';

export const isStorageConfigured = !!(bucket && accessKeyId && secretAccessKey && endpoint && publicUrl);

const sha256Hex = (data: string | Uint8Array) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key: crypto.BinaryLike, data: string) => crypto.createHmac('sha256', key).update(data).digest();

/** Uploads one object (path-style URL) and returns its public URL. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<string> {
  if (!isStorageConfigured) throw new Error('Storage is not configured.');

  const url = new URL(endpoint!);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(bucket!)}/${encodedKey}`;

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    url.pathname,
    '',
    `content-type:${contentType}\nhost:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), 's3'), 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`Storage upload failed (HTTP ${res.status}).`);

  return `${publicUrl!.replace(/\/$/, '')}/${encodedKey}`;
}
