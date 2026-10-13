import { NestFactory } from '@nestjs/core';
import { GatewayModule } from '../apps/gateway/src/gateway.module';
import { createSwaggerDocument } from '../apps/gateway/src/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

export async function exportOpenApi(
  options: { checkOnly?: boolean; targetFile?: string } = {},
) {
  // Ensure development/local environment defaults for contract export
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.APP_ENV = process.env.APP_ENV || 'local';

  // Instantiate application without listening to an HTTP network port
  const app = await NestFactory.create(GatewayModule, {
    logger: false,
  });

  try {
    const document = createSwaggerDocument(app);
    const serialized = JSON.stringify(document, null, 2) + '\n';

    const defaultDir = path.resolve(process.cwd(), 'contracts');
    const targetFile =
      options.targetFile || path.join(defaultDir, 'openapi.json');
    const targetDir = path.dirname(targetFile);

    const pathCount = Object.keys(document.paths || {}).length;
    const schemaCount = Object.keys(document.components?.schemas || {}).length;

    if (options.checkOnly) {
      if (!fs.existsSync(targetFile)) {
        console.error(
          `[OpenAPI Error] Target file does not exist: ${targetFile}\nRun 'npm run openapi:generate' to create it.`,
        );
        process.exit(1);
      }

      const existingContent = fs.readFileSync(targetFile, 'utf8');
      if (existingContent !== serialized) {
        console.error(
          `[OpenAPI Error] ${targetFile} is out of date with current Gateway annotations.\nRun 'npm run openapi:generate' to synchronize the contract.`,
        );
        process.exit(1);
      }

      console.log(
        `[OpenAPI Check] Contract is up-to-date: ${targetFile} (${pathCount} paths, ${schemaCount} schemas).`,
      );
      return { targetFile, pathCount, schemaCount, updated: false };
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetFile, serialized, 'utf8');
    const fileSizeKb = (Buffer.byteLength(serialized, 'utf8') / 1024).toFixed(2);

    console.log(
      `[OpenAPI] Successfully generated specification:\n  Location: ${targetFile}\n  Endpoints: ${pathCount} paths\n  Schemas:   ${schemaCount} schemas\n  Size:      ${fileSizeKb} KB`,
    );

    return { targetFile, pathCount, schemaCount, updated: true };
  } finally {
    await app.close();
  }
}

// Execute standalone when invoked directly from CLI
if (require.main === module) {
  const checkOnly = process.argv.includes('--check');
  exportOpenApi({ checkOnly }).catch((err) => {
    console.error('[OpenAPI Error] Generation failed:', err);
    process.exit(1);
  });
}
