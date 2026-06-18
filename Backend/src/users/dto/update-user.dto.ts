import { UserRole } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
