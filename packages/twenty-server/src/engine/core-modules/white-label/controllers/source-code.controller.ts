import { Controller, Get, Res, UseGuards } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { type Response } from 'express';
import { existsSync } from 'fs';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

// AGPL section 13: every user of the hosted app can fetch the exact running source.
@Controller('source-code')
export class SourceCodeController {
  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  @Get()
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  getSourceCode(@Res() response: Response): void {
    const sourceCodeUrl = this.twentyConfigService.get('SOURCE_CODE_URL');

    if (isNonEmptyString(sourceCodeUrl)) {
      response.redirect(302, sourceCodeUrl);

      return;
    }

    const archivePath = this.twentyConfigService.get(
      'SOURCE_CODE_ARCHIVE_PATH',
    );

    if (!existsSync(archivePath)) {
      response
        .status(404)
        .type('text')
        .send(
          'Source archive not bundled with this server. Set SOURCE_CODE_URL to where the source is published.',
        );

      return;
    }

    response.download(archivePath, 'source-code.tar.gz');
  }
}
