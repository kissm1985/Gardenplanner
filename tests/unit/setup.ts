// Unit tests check Hungarian texts unless a test switches the language itself.
import { beforeEach } from 'vitest';
import { setLang } from '../../src/i18n';

beforeEach(() => setLang('hu'));
