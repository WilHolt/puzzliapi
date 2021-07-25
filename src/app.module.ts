import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ModulesModule } from './modules/modules.module';
import { TesteModule } from './teste/teste.module';
import { Teste2Module } from './teste2/teste2.module';

@Module({
  imports: [ModulesModule, TesteModule, Teste2Module],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
