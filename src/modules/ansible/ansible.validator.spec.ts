import { BadRequestException } from '@nestjs/common';
import { AnsibleValidator } from './ansible.validator';

describe('AnsibleValidator.assertValidYamlPlaybook', () => {
  it('does not throw for parseable YAML', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('- hosts: all\n  tasks: []\n'),
    ).not.toThrow();
  });

  it('throws BadRequestException for unparseable YAML', () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('key: [unclosed'),
    ).toThrow(BadRequestException);
  });

  it("does not throw for YAML that is not a valid Ansible playbook shape — that is ansible-playbook's job, not this class's", () => {
    expect(() =>
      AnsibleValidator.assertValidYamlPlaybook('just a plain string'),
    ).not.toThrow();
  });
});
