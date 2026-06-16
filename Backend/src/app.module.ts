import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { type JwtModuleOptions } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = configService.get<JwtModuleOptions['signOptions'] extends infer T
          ? T extends { expiresIn?: infer E }
            ? E
            : never
          : never>('JWT_EXPIRES_IN') ?? '1d';

        return {
          secret: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
    AuthModule,
    OrdersModule,
  ],
})
export class AppModule {}
