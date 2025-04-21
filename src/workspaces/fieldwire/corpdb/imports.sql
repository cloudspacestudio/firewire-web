USE [corp]
GO

/****** Object:  Table [dbo].[imports]    Script Date: 4/15/2025 6:45:22 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[imports](
	[importId] [nvarchar](40) NOT NULL,
	[userId] [nvarchar](40) NOT NULL,
	[projectId] [nvarchar](40) NOT NULL,
	[floorplanId] [nvarchar](40) NOT NULL,
	[status] [nvarchar](50) NOT NULL,
	[height] [smallint] NOT NULL,
	[width] [smallint] NOT NULL,
	[topLeft] [smallint] NOT NULL,
	[topRight] [smallint] NOT NULL,
	[bottomLeft] [smallint] NOT NULL,
	[bottomRight] [smallint] NOT NULL,
	[itemCount] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_imports] PRIMARY KEY CLUSTERED 
(
	[importId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[imports] ADD  CONSTRAINT [DF_imports_importId]  DEFAULT (newid()) FOR [importId]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [height]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [width]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [topLeft]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [topRight]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [bottomLeft]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [bottomRight]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ((0)) FOR [itemCount]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[imports] ADD  DEFAULT ('system') FOR [updateby]
GO

