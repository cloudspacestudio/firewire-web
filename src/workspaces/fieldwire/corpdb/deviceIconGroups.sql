CREATE TABLE [dbo].[deviceIconGroups](
	[iconGroupId] [uniqueidentifier] NOT NULL,
	[name] [nvarchar](200) NOT NULL,
	[sortOrder] [int] NOT NULL,
	[createat] [datetime] NOT NULL,
	[createby] [nvarchar](100) NOT NULL,
	[updateat] [datetime] NOT NULL,
	[updateby] [nvarchar](100) NOT NULL,
 CONSTRAINT [PK_deviceIconGroups] PRIMARY KEY CLUSTERED 
(
	[iconGroupId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_iconGroupId]  DEFAULT (newid()) FOR [iconGroupId]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_sortOrder]  DEFAULT ((0)) FOR [sortOrder]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_createat]  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_createby]  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_updateat]  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[deviceIconGroups] ADD  CONSTRAINT [DF_deviceIconGroups_updateby]  DEFAULT ('system') FOR [updateby]
GO
