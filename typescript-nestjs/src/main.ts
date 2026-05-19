import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const PORT = 3005;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(PORT, "127.0.0.1");
  console.log(`TypeScript (NestJS) benchmark server listening on http://127.0.0.1:${PORT}`);
}

bootstrap();
