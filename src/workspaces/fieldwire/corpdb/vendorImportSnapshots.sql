CREATE TABLE [dbo].[vendorImportSnapshots](
	[snapshotId] [nvarchar](40) NOT NULL,
	[vendorId] [nvarchar](40) NOT NULL,
	[targetTable] [nvarchar](128) NOT NULL,
	[fileName] [nvarchar](260) NOT NULL,
	[summaryJson] [nvarchar](max) NOT NULL,
	[rowsJson] [nvarchar](max) NOT NULL,
	[rowCount] [int] NOT NULL,
	[createdAt] [datetime] NOT NULL,
	[createdBy] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_vendorImportSnapshots] PRIMARY KEY CLUSTERED
(
	[snapshotId] ASC
) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[vendorImportSnapshots] ADD  CONSTRAINT [DF_vendorImportSnapshots_snapshotId]  DEFAULT (newid()) FOR [snapshotId]
GO

ALTER TABLE [dbo].[vendorImportSnapshots] ADD  CONSTRAINT [DF_vendorImportSnapshots_createdAt]  DEFAULT (getdate()) FOR [createdAt]
GO

ALTER TABLE [dbo].[vendorImportSnapshots] ADD  CONSTRAINT [DF_vendorImportSnapshots_createdBy]  DEFAULT ('system') FOR [createdBy]
GO
