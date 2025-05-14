CREATE TABLE [dbo].[EddyPricelist](
	[ParentCategory] [nvarchar](500) NULL,
	[Category] [nvarchar](500) NULL,
	[PartNumber] [nvarchar](100) NULL,
	[LongDescription] [nvarchar](1000) NULL,
	[MSRPPrice] [money] NULL,
	[SalesPrice] [money] NULL,
	[FuturePrice] [money] NULL,
	[FutureEffectiveDate] [date] NULL,
	[FutureSalesPrice] [money] NULL,
	[FutureSalesEffectiveDate] [date] NULL,
	[MinOrderQuantity] [int] NULL,
	[ProductStatus] [nvarchar](500) NULL,
	[Agency] [nvarchar](50) NULL,
	[CountryOfOrigin] [nvarchar](50) NULL,
	[UPC] [nvarchar](50) NULL
) ON [PRIMARY]
GO

