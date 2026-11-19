import { generate } from 'openapi-typescript-codegen';
import { appendFile } from 'node:fs/promises';

const input = process.env.OPENAPI_URL || 'http://localhost:5085/swagger/v1/swagger.json';
const output = 'libs/api-client/src';

console.log(`[openapi] Generating Angular client from ${input}`);

await generate({
  input,
  output,
  httpClient: 'angular',
  useOptions: true,
  useUnionTypes: false,
  exportCore: true,
  exportServices: true,
  exportModels: true,
});
// Keep the UI-only progress projection exported; HTTP clients come from OpenAPI.
await appendFile(`${output}/index.ts`, "\nexport * from './vector-index';\n");

console.log(`[openapi] Client generated at ${output}`);
