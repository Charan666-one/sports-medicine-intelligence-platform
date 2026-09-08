import SwaggerParser from '@apidevtools/swagger-parser';

try {
  const api = await SwaggerParser.validate('openapi.yaml');
  console.log(`✔ openapi.yaml is valid OpenAPI ${api.openapi} — ${Object.keys(api.paths).length} paths`);
} catch (err) {
  console.error('✘ openapi.yaml failed validation:\n' + err.message);
  process.exit(1);
}
