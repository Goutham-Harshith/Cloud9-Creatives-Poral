import { UnauthorizedException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compareSync, hashSync } from 'bcryptjs';

import { LoginDto } from './dto/login.dto';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SALES' | 'PRODUCTION' | 'DISPATCH' | 'CUSTOMER';

interface DemoUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

@Injectable()
export class AuthService {
  private readonly users: DemoUser[] = [
    {
      id: 'usr_cloud9_super_admin',
      email: 'gouthamharshith115@gmail.com',
      name: 'Cloud9 Admin',
      role: 'SUPER_ADMIN',
      passwordHash: hashSync('test@123', 10),
    },
  ];

  constructor(private readonly jwtService: JwtService) {}

  login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();
    const user = this.users.find((candidate) => candidate.email === email);

    if (!user || !compareSync(loginDto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }
}
