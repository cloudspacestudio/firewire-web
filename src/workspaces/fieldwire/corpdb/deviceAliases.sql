CREATE TABLE [dbo].[deviceAliases](
	[aliasId] [nvarchar](50) NOT NULL,
	[aliasText] [nvarchar](255) NOT NULL,
	[matchToText] [nvarchar](255) NOT NULL,
	[projectId] [nvarchar](50) NULL,
	[batchId] [nvarchar](50) NULL,
	[org] [nvarchar](40) NULL,
 CONSTRAINT [PK_deviceAliases] PRIMARY KEY CLUSTERED 
(
	[aliasId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[deviceAliases] ADD  CONSTRAINT [DF_deviceAliases_aliasId]  DEFAULT (newid()) FOR [aliasId]
GO

