import { expect, test } from '@oclif/test';
import * as EsUtils from '../../src/utils/es/EsUtils';
import MockElasticsearchClient from '../mock/MockElasticsearchClient';

describe('info command test', () => {
    test.stdout()
        .env({
            ELASTICSEARCH_MIGRATION_LOCATIONS: `${process.cwd()}/test/data/migration`,
            ELASTICSEARCH_MIGRATION_BASELINE_VERSION: 'v1.0.0',
            ELASTICSEARCH_VERSION: '7',
            ELASTICSEARCH_HOST: 'http://localhost:9202'
        })
        .command(['info', '-i', 'test'])
        .exit(1)
        .it('Migration file not found.');

    test.stub(EsUtils, 'default', () => new MockElasticsearchClient())
        .env({
            ELASTICSEARCH_MIGRATION_LOCATIONS: `${process.cwd()}/test/data/migration`,
            ELASTICSEARCH_MIGRATION_BASELINE_VERSION: 'v1.0.0',
            ELASTICSEARCH_VERSION: '7',
            ELASTICSEARCH_HOST: 'http://localhost:9202'
        })
        .stdout()
        .command(['info', '-i', 'test1'])
        .it('info test', (ctx) => {
            expect(ctx.stdout).to.contain(
                'Version Description Type      Installedon State    \n' +
                    'v1.0.0  description ADD_FIELD             BASELINE '
            );
        });

    test.stub(EsUtils, 'default', () => new MockElasticsearchClient())
        .env({
            ELASTICSEARCH_MIGRATION_LOCATIONS: `${process.cwd()}/test/data/migration`,
            ELASTICSEARCH_MIGRATION_BASELINE_VERSION: 'v1.0.0',
            ELASTICSEARCH_VERSION: '7',
            ELASTICSEARCH_HOST: 'http://localhost:9202'
        })
        .stdout()
        .command(['info', '-i', 'test2-2020.01.01'])
        .it('info versiond index test', (ctx) => {
            expect(ctx.stdout).to.contain(
                'Version Description Type      Installedon State    \n' +
                    'v1.0.0  description ADD_FIELD             BASELINE '
            );
        });

    test.stub(EsUtils, 'default', () => new MockElasticsearchClient())
        .env({
            ELASTICSEARCH_MIGRATION_LOCATIONS: `${process.cwd()}/test/data/migration`,
            ELASTICSEARCH_MIGRATION_BASELINE_VERSION: 'v1.0.0',
            ELASTICSEARCH_VERSION: '7',
            ELASTICSEARCH_HOST: 'http://localhost:9202'
        })
        .stdout()
        .command(['info', '-i', 'test2_2020.01.01'])
        .it('info other versiond index test', (ctx) => {
            expect(ctx.stdout).to.contain(
                'Version Description Type      Installedon State    \n' +
                    'v1.0.0  description ADD_FIELD             BASELINE '
            );
        });
});
