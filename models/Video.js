module.exports = (sequelize, DataTypes) => {
  const Video = sequelize.define("Video", {
    name: DataTypes.STRING,
    path: DataTypes.STRING,
    size: DataTypes.INTEGER,
    duration: DataTypes.FLOAT,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'uploaded'
    },
    finalPath: DataTypes.STRING,
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Users',
        key: 'id',     
      },
      allowNull: true,
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  Video.associate = function(models) {
    Video.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return Video;
};
