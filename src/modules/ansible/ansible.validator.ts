import { BadRequestException } from '@nestjs/common';
import { load } from 'js-yaml';

const INVALID_YAML_MESSAGE =
  'fileContent is not valid YAML — cannot run it as an Ansible playbook';

export class AnsibleValidator {
  static assertValidYamlPlaybook(fileContent: string): void {
    try {
      load(fileContent);
    } catch {
      throw new BadRequestException(INVALID_YAML_MESSAGE);
    }
  }
}
