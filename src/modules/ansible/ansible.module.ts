import { Module } from '@nestjs/common';
import { AnsibleService } from './ansible.service';
import { AnsibleConnector } from './ansible.connector';

@Module({
  providers: [AnsibleService, AnsibleConnector],
  exports: [AnsibleService],
})
export class AnsibleModule {}
