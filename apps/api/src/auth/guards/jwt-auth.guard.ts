import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { isObservable, lastValueFrom } from 'rxjs';
import { AuthLifecycleService } from '../auth-lifecycle.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly authLifecycleService: AuthLifecycleService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const canActivate = await this.resolveCanActivate(super.canActivate(context));

    if (!canActivate) {
      return false;
    }

    await this.authLifecycleService.enforce(context);

    return true;
  }

  private resolveCanActivate(
    result: ReturnType<CanActivate['canActivate']>,
  ): Promise<boolean> | boolean {
    if (isObservable(result)) {
      return lastValueFrom(result);
    }

    return result;
  }
}
