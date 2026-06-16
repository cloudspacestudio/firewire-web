IF OBJECT_ID(N'dbo.firewireProjectSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.firewireProjectSettings (
        uuid UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjectSettings PRIMARY KEY,
        listKey NVARCHAR(50) NOT NULL,
        division NVARCHAR(50) NULL,
        label NVARCHAR(2000) NOT NULL,
        description NVARCHAR(2000) NOT NULL CONSTRAINT DF_firewireProjectSettings_description DEFAULT N'',
        sortOrder INT NOT NULL CONSTRAINT DF_firewireProjectSettings_sortOrder DEFAULT 0,
        isActive BIT NOT NULL CONSTRAINT DF_firewireProjectSettings_isActive DEFAULT 1,
        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectSettings_createdAt DEFAULT SYSUTCDATETIME(),
        createdBy NVARCHAR(256) NOT NULL,
        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectSettings_updatedAt DEFAULT SYSUTCDATETIME(),
        updatedBy NVARCHAR(256) NOT NULL
    );
END;

IF COL_LENGTH(N'dbo.firewireProjectSettings', N'division') IS NULL
BEGIN
    ALTER TABLE dbo.firewireProjectSettings ADD division NVARCHAR(50) NULL;
END;

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_firewireProjectSettings_list_label'
      AND object_id = OBJECT_ID(N'dbo.firewireProjectSettings')
)
BEGIN
    DROP INDEX UX_firewireProjectSettings_list_label ON dbo.firewireProjectSettings;
END;

ALTER TABLE dbo.firewireProjectSettings ALTER COLUMN label NVARCHAR(2000) NOT NULL;
ALTER TABLE dbo.firewireProjectSettings ALTER COLUMN description NVARCHAR(2000) NOT NULL;
