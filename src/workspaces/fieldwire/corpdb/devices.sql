USE [corp]
GO

/****** Object:  Table [dbo].[devices]    Script Date: 4/15/2025 6:44:12 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[devices](
	[deviceId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[shortName] [nvarchar](50) NOT NULL,
	[categoryId] [nvarchar](40) NOT NULL,
	[vendorId] [nvarchar](40) NOT NULL,
	[partNumber] [nvarchar](40) NOT NULL,
	[link] [nvarchar](1024) NOT NULL,
	[cost] [money] NOT NULL,
	[defaultLabor] [decimal](18, 0) NOT NULL,
	[slcAddress] [nvarchar](50) NULL,
	[serialNumber] [nvarchar](50) NULL,
	[strobeAddress] [nvarchar](50) NULL,
	[speakerAddress] [nvarchar](50) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_devices2] PRIMARY KEY CLUSTERED 
(
	[deviceId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[devices] ADD  CONSTRAINT [DF_devices_deviceId]  DEFAULT (newid()) FOR [deviceId]
GO

ALTER TABLE [dbo].[devices] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[devices] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[devices] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[devices] ADD  DEFAULT ('system') FOR [updateby]
GO

