CREATE TABLE [dbo].[vendorImportRuns](
	[runId] [nvarchar](40) NOT NULL,
	[vendorId] [nvarchar](40) NOT NULL,
	[targetTable] [nvarchar](128) NOT NULL,
	[fileName] [nvarchar](260) NOT NULL,
	[snapshotId] [nvarchar](40) NULL,
	[action] [nvarchar](30) NOT NULL,
	[rowCount] [int] NOT NULL,
	[importedAt] [datetime] NOT NULL,
	[createdBy] [nvarchar](40) NOT NULL,
	[notesJson] [nvarchar](max) NULL,
 CONSTRAINT [PK_vendorImportRuns] PRIMARY KEY CLUSTERED
(
	[runId] ASC
) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[vendorImportRuns] ADD CONSTRAINT [DF_vendorImportRuns_runId] DEFAULT (newid()) FOR [runId]
GO

ALTER TABLE [dbo].[vendorImportRuns] ADD CONSTRAINT [DF_vendorImportRuns_importedAt] DEFAULT (getdate()) FOR [importedAt]
GO

ALTER TABLE [dbo].[vendorImportRuns] ADD CONSTRAINT [DF_vendorImportRuns_createdBy] DEFAULT ('system') FOR [createdBy]
GO
