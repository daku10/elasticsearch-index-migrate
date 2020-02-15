import {
    ResolvedMigration,
    MigrateIndex,
    MigrationInfo,
    MigrationInfoContext,
    MigrationState,
    MigrationStateInfo,
    MigrationType,
    AppliedMigration
} from '../../model/types';
import sort from 'sort-versions';

interface IMigrationInfoService {
    all(): MigrationInfo[] | undefined;
    current(): MigrationInfo | undefined;
    pending(): MigrationInfo[];
    applied(): MigrationInfo[];
}

export class MigrationInfoImpl implements MigrationInfo {
    resolvedMigration?: ResolvedMigration;
    appliedMigration?: AppliedMigration;
    context: MigrationInfoContext;
    outOfOrder: boolean;

    constructor(
        context: MigrationInfoContext,
        outOfOrder: boolean,
        resolvedMigration?: ResolvedMigration,
        appliedMigration?: AppliedMigration
    ) {
        this.resolvedMigration = resolvedMigration;
        this.appliedMigration = appliedMigration;
        this.context = context;
        this.outOfOrder = outOfOrder;
    }

    getVersion() {
        if (this.appliedMigration) {
            return this.appliedMigration.version;
        }
        return this.resolvedMigration?.version;
    }

    getState(): MigrationStateInfo | undefined {
        if (this.appliedMigration === undefined) {
            if (this.resolvedMigration?.version !== undefined) {
                if (this.resolvedMigration?.version < this.context.baseline) {
                    return MigrationStateInfo.get(MigrationState.BELOW_BASELINE);
                }
                if (this.outOfOrder) {
                    return MigrationStateInfo.get(MigrationState.IGNORED);
                }
            }
            return MigrationStateInfo.get(MigrationState.PENDING);
        }

        if (MigrationType.BASELINE === this.appliedMigration.type) {
            return MigrationStateInfo.get(MigrationState.BASELINE);
        }

        if (!this.resolvedMigration) {
            const version = this.getVersion() ?? '';
            if (!this.appliedMigration.version || version < this.context.lastResolved) {
                if (this.appliedMigration?.success) {
                    return MigrationStateInfo.get(MigrationState.MISSING_SUCCESS);
                }
                return MigrationStateInfo.get(MigrationState.MISSING_FAILED);
            } else {
                if (this.appliedMigration.success) {
                    return MigrationStateInfo.get(MigrationState.FUTURE_SUCCESS);
                }
                return MigrationStateInfo.get(MigrationState.FUTURE_FAILED);
            }
        }

        if (!this.appliedMigration?.success) {
            return MigrationStateInfo.get(MigrationState.FAILED);
        }

        if (this.outOfOrder) {
            return MigrationStateInfo.get(MigrationState.OUT_OF_ORDER);
        }
        return MigrationStateInfo.get(MigrationState.SUCCESS);
    }
}

class MigrationInfoService implements IMigrationInfoService {
    migrationInfos: MigrationInfoImpl[];
    resolvedMigrations: ResolvedMigration[];
    appliedMigrations: MigrateIndex[];
    context: MigrationInfoContext;

    constructor(
        resolvedMigrations: ResolvedMigration[],
        appliedMigrations: MigrateIndex[],
        context: MigrationInfoContext
    ) {
        this.resolvedMigrations = resolvedMigrations;
        this.appliedMigrations = appliedMigrations;
        this.migrationInfos = [];
        this.context = context;
    }

    refresh() {
        const migrationInfoMap = new Map<string, MigrationInfoImpl>();
        const appliedMigrationVersions = sort(
            this.appliedMigrations.map((value) => value.migrate_version)
        );
        const lastApplied = appliedMigrationVersions[appliedMigrationVersions.length - 1];
        const resolvedMigrationVersions = sort(
            this.resolvedMigrations.map((value) => value.version)
        );
        const lastResolved = resolvedMigrationVersions[resolvedMigrationVersions.length - 1];

        const context: MigrationInfoContext = {
            ...this.context,
            lastResolved,
            lastApplied
        };

        this.resolvedMigrations.forEach((value) => {
            const migrationInfo = migrationInfoMap.get(value.version);
            if (migrationInfo) {
                migrationInfoMap.set(
                    value.version,
                    new MigrationInfoImpl(
                        context,
                        migrationInfo.outOfOrder,
                        value,
                        migrationInfo.appliedMigration
                    )
                );
                migrationInfo.resolvedMigration = value;
            } else {
                migrationInfoMap.set(value.version, new MigrationInfoImpl(context, false, value));
            }
        });
        this.appliedMigrations.forEach((value) => {
            const migrationInfo = migrationInfoMap.get(value.migrate_version);
            const appliedMigration = {
                installedRank: value.installed_rank,
                version: value.migrate_version,
                description: value.description,
                type: value.script_type,
                script: value.script_name,
                installedOn: value.installed_on,
                executionTime: value.execution_time,
                success: value.success
            };
            if (migrationInfo) {
                migrationInfoMap.set(
                    value.migrate_version,
                    new MigrationInfoImpl(
                        context,
                        migrationInfo.outOfOrder,
                        migrationInfo.resolvedMigration,
                        appliedMigration
                    )
                );
            } else {
                migrationInfoMap.set(
                    value.migrate_version,
                    new MigrationInfoImpl(context, false, undefined, appliedMigration)
                );
            }
        });

        const keys: string[] = [];
        migrationInfoMap.forEach((value, key) => {
            keys.push(key);
        });
        const sortedKeys = sort(keys);

        sortedKeys.forEach((version, index) => {
            const migrationInfo = migrationInfoMap.get(version);
            if (migrationInfo?.resolvedMigration && migrationInfo?.appliedMigration === undefined) {
                const outOfOrder = !!sortedKeys
                    .slice(index, sortedKeys.length)
                    .map((value) => {
                        const info = migrationInfoMap.get(value);
                        return !!info?.appliedMigration;
                    })
                    .find((value) => value);
                this.migrationInfos.push(
                    new MigrationInfoImpl(
                        migrationInfo.context,
                        outOfOrder,
                        migrationInfo.resolvedMigration,
                        migrationInfo.appliedMigration
                    )
                );
            } else if (migrationInfo) {
                this.migrationInfos.push(migrationInfo);
            }
        });
    }

    all(): MigrationInfo[] {
        return this.migrationInfos;
    }

    applied(): MigrationInfo[] {
        return this.migrationInfos.filter((value) => value.getState()?.applied);
    }

    current(): MigrationInfo | undefined {
        let current: MigrationInfoImpl | undefined = undefined;

        this.migrationInfos.forEach((value) => {
            if (
                value.getState()?.applied &&
                value.getVersion() &&
                (current === undefined ||
                    value.getVersion()?.localeCompare(current?.getVersion() ?? ''))
            ) {
                current = value;
            }
        });
        if (current) {
            return current;
        }
        return this.migrationInfos.reverse().find((value) => value.getState()?.applied);
    }

    pending(): MigrationInfo[] {
        return this.migrationInfos.filter(
            (value) => value.getState()?.status === MigrationState.PENDING
        );
    }
}

export default MigrationInfoService;
