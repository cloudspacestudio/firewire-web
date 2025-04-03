USE [corp]
GO

/****** Object:  Table [dbo].[symbolMaps]    Script Date: 4/2/2025 11:58:03 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[symbolMaps](
	[symbolMapId] [nvarchar](40) NOT NULL,
	[importId] [nvarchar](40) NOT NULL,
	[projectId] [nvarchar](40) NOT NULL,
	[columnName] [nvarchar](200) NOT NULL,
	[mapToMaterialId] [nvarchar](40) NOT NULL,
	[ordinal] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_symbolmaps] PRIMARY KEY CLUSTERED 
(
	[symbolMapId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  CONSTRAINT [DF_symbolMaps_symbolMapId]  DEFAULT (newid()) FOR [symbolMapId]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[symbolMaps] ADD  DEFAULT ('system') FOR [updateby]
GO

