import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

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
}
