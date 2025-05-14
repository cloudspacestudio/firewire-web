CREATE TABLE [dbo].[documents](
	[documentId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[desc] [nvarchar](500) NULL,
	[link] [nvarchar](500) NULL,
	[linkType] [nvarchar](50) NOT NULL,
	[materialId] [nvarchar](40) NOT NULL,
	[source] [nvarchar](max) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_documents] PRIMARY KEY CLUSTERED 
(
	[documentId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[documents] ADD  CONSTRAINT [DF_documents_documentId]  DEFAULT (newid()) FOR [documentId]
GO

ALTER TABLE [dbo].[documents] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[documents] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[documents] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[documents] ADD  DEFAULT ('system') FOR [updateby]
GO

