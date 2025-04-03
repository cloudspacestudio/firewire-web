USE [corp]
GO

/****** Object:  Table [dbo].[categoryAttributes]    Script Date: 4/2/2025 11:53:44 PM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[categoryAttributes](
	[categoryAttributeId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[statusId] [nvarchar](50) NOT NULL,
	[categoryId] [nvarchar](40) NOT NULL,
	[projectId] [nvarchar](40) NULL,
	[valueType] [nvarchar](40) NULL,
	[defaultValue] [nvarchar](255) NULL,
	[ordinal] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_categoryattributes] PRIMARY KEY CLUSTERED 
(
	[categoryAttributeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[categoryAttributes] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[categoryAttributes] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[categoryAttributes] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[categoryAttributes] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[categoryAttributes] ADD  DEFAULT ('system') FOR [updateby]
GO

