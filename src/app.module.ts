import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModulesModule } from './modules/modules.module';

@Module({
  imports: [ModulesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
