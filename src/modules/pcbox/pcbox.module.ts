import { Module } from '@nestjs/common';
import { PcboxController } from './pcbox.controller';
import { PcboxService } from './pcbox.service';
import { AnsibleModule } from '../ansible/ansible.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AnsibleModule, AuthModule],
  controllers: [PcboxController],
  providers: [PcboxService],
})
export class PcboxModule {}
