CREATE TABLE [dbo].[deviceIcons](
	[iconId] [uniqueidentifier] NOT NULL,
	[iconGroupId] [uniqueidentifier] NOT NULL,
	[label] [nvarchar](200) NOT NULL,
	[fileName] [nvarchar](260) NULL,
	[mimeType] [nvarchar](120) NULL,
	[dataUrl] [nvarchar](max) NOT NULL,
	[sortOrder] [int] NOT NULL,
	[createat] [datetime] NOT NULL,
	[createby] [nvarchar](100) NOT NULL,
	[updateat] [datetime] NOT NULL,
	[updateby] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK_deviceIcons] PRIMARY KEY CLUSTERED 
(
	[iconId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_iconId]  DEFAULT (newid()) FOR [iconId]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_sortOrder]  DEFAULT ((0)) FOR [sortOrder]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_createat]  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_createby]  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_updateat]  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[deviceIcons] ADD  CONSTRAINT [DF_deviceIcons_updateby]  DEFAULT ('system') FOR [updateby]
GO

CREATE NONCLUSTERED INDEX [IX_deviceIcons_iconGroupId] ON [dbo].[deviceIcons]
(
	[iconGroupId] ASC,
	[sortOrder] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
