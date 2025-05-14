CREATE TABLE [dbo].[devicematerials](
	[mapId] [nvarchar](50) NOT NULL,
	[deviceId] [nvarchar](50) NOT NULL,
	[materialId] [nvarchar](50) NOT NULL,
	[createat] [datetime] NOT NULL,
	[createby] [nvarchar](50) NOT NULL,
	[updateat] [datetime] NOT NULL,
	[updateby] [nvarchar](50) NOT NULL,
 CONSTRAINT [PK_devicematerials] PRIMARY KEY CLUSTERED 
(
	[mapId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[devicematerials] ADD  CONSTRAINT [DF_devicematerials_mapId]  DEFAULT (newid()) FOR [mapId]
GO

ALTER TABLE [dbo].[devicematerials] ADD  CONSTRAINT [DF_devicematerials_createat]  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[devicematerials] ADD  CONSTRAINT [DF_devicematerials_createby]  DEFAULT (N'system') FOR [createby]
GO

ALTER TABLE [dbo].[devicematerials] ADD  CONSTRAINT [DF_devicematerials_updateat]  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[devicematerials] ADD  CONSTRAINT [DF_devicematerials_updateby]  DEFAULT (N'system') FOR [updateby]
GO

