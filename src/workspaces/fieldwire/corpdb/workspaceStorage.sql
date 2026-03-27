IF OBJECT_ID('dbo.workspaceStorage', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.workspaceStorage (
        [workspaceStorageId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_workspaceStorage_workspaceStorageId] DEFAULT NEWID(),
        [area] NVARCHAR(100) NOT NULL,
        [workspaceKey] NVARCHAR(200) NOT NULL,
        [payloadJson] NVARCHAR(MAX) NOT NULL,
        [createat] DATETIME NOT NULL CONSTRAINT [DF_workspaceStorage_createat] DEFAULT GETDATE(),
        [createby] NVARCHAR(100) NOT NULL CONSTRAINT [DF_workspaceStorage_createby] DEFAULT ('system'),
        [updateat] DATETIME NOT NULL CONSTRAINT [DF_workspaceStorage_updateat] DEFAULT GETDATE(),
        [updateby] NVARCHAR(100) NOT NULL CONSTRAINT [DF_workspaceStorage_updateby] DEFAULT ('system'),
        CONSTRAINT [PK_workspaceStorage] PRIMARY KEY CLUSTERED ([workspaceStorageId] ASC)
    )

    CREATE UNIQUE NONCLUSTERED INDEX [IX_workspaceStorage_area_workspaceKey]
        ON dbo.workspaceStorage([area] ASC, [workspaceKey] ASC)
END
