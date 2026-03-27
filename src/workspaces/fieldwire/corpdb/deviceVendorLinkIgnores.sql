CREATE TABLE [dbo].[deviceVendorLinkIgnores](
	[ignoreId] [nvarchar](40) NOT NULL,
	[deviceId] [nvarchar](40) NOT NULL,
	[vendorId] [nvarchar](40) NOT NULL,
	[partNumber] [nvarchar](100) NOT NULL,
	[sourceKind] [nvarchar](20) NOT NULL,
	[reason] [nvarchar](500) NULL,
	[createat] [datetime] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_deviceVendorLinkIgnores] PRIMARY KEY CLUSTERED
(
	[ignoreId] ASC
) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[deviceVendorLinkIgnores] ADD CONSTRAINT [DF_deviceVendorLinkIgnores_ignoreId] DEFAULT (newid()) FOR [ignoreId]
GO

ALTER TABLE [dbo].[deviceVendorLinkIgnores] ADD CONSTRAINT [DF_deviceVendorLinkIgnores_createat] DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceVendorLinkIgnores] ADD CONSTRAINT [DF_deviceVendorLinkIgnores_createby] DEFAULT ('system') FOR [createby]
GO
