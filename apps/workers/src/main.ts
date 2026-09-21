import { NestFactory } from '@nestjs/core';
import { WorkersModule } from './workers.module';
import { SERVER_CONFIG } from 'apps/gateway/src/common/constants/server.constants';

async function bootstrap() {
  const app = await NestFactory.create(WorkersModule);
  await app.listen(process.env.PORT ?? SERVER_CONFIG.DEFAULT_WORKER_PORT);
}
bootstrap().catch((err) => {
  console.error('Failed to start Workers application', err);
  process.exit(1);
});
