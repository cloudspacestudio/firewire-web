CREATE TABLE [dbo].[materials](
	[materialId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[shortName] [nvarchar](50) NOT NULL,
	[categoryId] [nvarchar](40) NOT NULL,
	[vendorId] [nvarchar](40) NOT NULL,
	[partNumber] [nvarchar](40) NOT NULL,
	[link] [nvarchar](1024) NOT NULL,
	[cost] [money] NOT NULL,
	[defaultLabor] [smallint] NOT NULL,
	[slcAddress] [nvarchar](50) NULL,
	[serialNumber] [nvarchar](50) NULL,
	[strobeAddress] [nvarchar](50) NULL,
	[speakerAddress] [nvarchar](50) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_materials] PRIMARY KEY CLUSTERED 
(
	[materialId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[materials] ADD  CONSTRAINT [DF_materials_materialId]  DEFAULT (newid()) FOR [materialId]
GO

ALTER TABLE [dbo].[materials] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[materials] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[materials] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[materials] ADD  DEFAULT ('system') FOR [updateby]
GO

