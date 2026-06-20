import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  login(user: {
    id: string;
    email: string;
    name: string;
    picture?: string | null;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture ?? undefined,
    };
    return this.jwtService.sign(payload);
  }

  async register(
    email: string,
    name: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.usersService.createWithPassword(
      email,
      name,
      passwordHash,
    );
    return { access_token: this.login(user) };
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const hash: string = user.passwordHash;
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { access_token: this.login(user) };
  }
}
