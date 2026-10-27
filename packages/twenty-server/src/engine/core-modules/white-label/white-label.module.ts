import { Module } from '@nestjs/common';

import { SourceCodeController } from 'src/engine/core-modules/white-label/controllers/source-code.controller';
import { WhiteLabelService } from 'src/engine/core-modules/white-label/services/white-label.service';

@Module({
  controllers: [SourceCodeController],
  providers: [WhiteLabelService],
  exports: [WhiteLabelService],
})
export class WhiteLabelModule {}
