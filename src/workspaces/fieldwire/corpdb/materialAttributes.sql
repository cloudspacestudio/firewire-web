CREATE TABLE [dbo].[materialAttributes](
	[materialAttributeId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[statusId] [nvarchar](50) NOT NULL,
	[materialId] [nvarchar](40) NOT NULL,
	[projectId] [nvarchar](40) NULL,
	[valueType] [nvarchar](40) NULL,
	[defaultValue] [nvarchar](255) NULL,
	[ordinal] [smallint] NOT NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
    [org] [nvarchar](40) NULL,
 CONSTRAINT [PK_materialattributes] PRIMARY KEY CLUSTERED 
(
	[materialAttributeId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  CONSTRAINT [DF_materialAttributes_materialAttributeId]  DEFAULT (newid()) FOR [materialAttributeId]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  DEFAULT ((0)) FOR [ordinal]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[materialAttributes] ADD  DEFAULT ('system') FOR [updateby]
GO

