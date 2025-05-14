CREATE TABLE [dbo].[importItems](
	[importItemId] [nvarchar](40) NOT NULL,
	[importId] [nvarchar](40) NOT NULL,
	[status] [nvarchar](50) NOT NULL,
	[deviceId] [nvarchar](40) NOT NULL,
	[title] [nvarchar](50) NOT NULL,
	[taskId] [nvarchar](50) NOT NULL,
	[masterOnly] [bit] NOT NULL,
	[posX] [smallint] NOT NULL,
	[posY] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_importitems] PRIMARY KEY CLUSTERED 
(
	[importItemId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[importItems] ADD  CONSTRAINT [DF_importItems_importItemId]  DEFAULT (newid()) FOR [importItemId]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT ((1)) FOR [masterOnly]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT ((0)) FOR [posX]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT ((0)) FOR [posY]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[importItems] ADD  DEFAULT ('system') FOR [updateby]
GO

