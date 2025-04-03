USE [corp]
GO

/****** Object:  Table [dbo].[categories]    Script Date: 4/2/2025 11:52:36 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[categories](
	[categoryId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[shortName] [nvarchar](50) NOT NULL,
	[handle] [nvarchar](10) NOT NULL,
	[taskNameFormat] [nvarchar](200) NOT NULL,
	[defaultCost] [money] NOT NULL,
	[defaultLabor] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_categories] PRIMARY KEY CLUSTERED 
(
	[categoryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[categories] ADD  CONSTRAINT [DF_categories_categoryId]  DEFAULT (newid()) FOR [categoryId]
GO

ALTER TABLE [dbo].[categories] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[categories] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[categories] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[categories] ADD  DEFAULT ('system') FOR [updateby]
GO

