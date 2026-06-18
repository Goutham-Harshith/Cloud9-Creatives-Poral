import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map((user) => this.toUserResponse(user));
  }

  async create(createUserDto: CreateUserDto) {
    const email = createUserDto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: this.normalizeName(createUserDto.name, email),
        passwordHash: hashSync(createUserDto.password, 10),
        role: createUserDto.role ?? UserRole.SALES,
        isActive: true,
      },
    });

    return this.toUserResponse(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser: { sub: string; role: UserRole }) {
    const email = updateUserDto.email.trim().toLowerCase();
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    if (targetUser.role === UserRole.SUPER_ADMIN) {
      if (targetUser.id !== currentUser.sub) {
        throw new ForbiddenException('Super admin accounts cannot be edited by another user.');
      }

      const user = await this.prisma.user.update({
        where: {
          id,
        },
        data: {
          name: this.normalizeName(updateUserDto.name, targetUser.email),
          ...(updateUserDto.password
            ? {
                passwordHash: hashSync(updateUserDto.password, 10),
              }
            : {}),
        },
      });

      return this.toUserResponse(user);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser && existingUser.id !== id) {
      throw new ConflictException('A user with this email already exists.');
    }

    const user = await this.prisma.user.update({
      where: {
        id,
      },
      data: {
        email,
        name: this.normalizeName(updateUserDto.name, email),
        role: updateUserDto.role,
        isActive: updateUserDto.isActive,
        ...(updateUserDto.password
          ? {
              passwordHash: hashSync(updateUserDto.password, 10),
            }
          : {}),
      },
    });

    return this.toUserResponse(user);
  }

  async delete(id: string, currentUser: { sub: string; role: UserRole }) {
    const targetUser = await this.prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found.');
    }

    if (targetUser.role === UserRole.SUPER_ADMIN || targetUser.id === currentUser.sub) {
      throw new ForbiddenException('This user cannot be deleted.');
    }

    const user = await this.prisma.user.delete({
      where: {
        id,
      },
    });

    return {
      id: user.id,
      deleted: true,
    };
  }

  private toUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private createNameFromEmail(email: string): string {
    return email
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private normalizeName(name: string | undefined, email: string): string {
    return name?.trim() || this.createNameFromEmail(email);
  }
}
