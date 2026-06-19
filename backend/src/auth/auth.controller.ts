import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Passport redirects to Google — handler body is never reached
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req()
    req: Request & {
      user: {
        id: string;
        email: string;
        name: string;
        picture?: string | null;
      };
    },
    @Res() res: Response,
  ) {
    const token = this.authService.login(req.user);
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    res.redirect(`${frontendUrl}/?token=${token}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
